import type {
  BubutInvoiceCancelRequest,
  BubutInvoiceReleaseRequest,
  BubutInvoiceSnapshot,
  BubutInvoiceType,
  BubutInvoiceWorkHistory,
  BubutInvoiceWorkOrderQuery,
  BubutInvoiceUpdateRequest,
} from "@smsystem/contracts/bubut-invoice";
import { DefaultAuditService, type AuditService } from "@/services/audit/audit.service";
import { MySqlAuditRepository } from "@/repositories/audit.repo";
import {
  MySqlBubutInvoiceRepository,
  type BubutInvoiceRepository,
} from "@/repositories/bubut-invoice.repo";
import type { WebSession } from "@/services/auth/session.service";
import {
  buildBubutInvoiceTotals,
  calculateWorkingHourTotal,
  decimalHoursToMinutes,
  minutesToHourText,
} from "@/services/bubut-invoice/calculation";

interface ListResult {
  data: Awaited<ReturnType<BubutInvoiceRepository["findCompletedBubutWorkOrders"]>>["rows"];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  query: BubutInvoiceWorkOrderQuery;
}

function buildMeta(page: number, limit: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatInvoiceNo(date: string, sequence: number): string {
  const [year, month] = date.split("-");
  return `SIB/${String(sequence).padStart(2, "0")}/${month}/${year}`;
}

function buildSelectedInvoicePictures(
  pictures: BubutInvoiceSnapshot["pictures"],
  beforeUrls: string[] = [],
  afterUrls: string[] = [],
): BubutInvoiceSnapshot["pictures"] {
  const byUrl = new Map(pictures.map((picture) => [picture.url, picture]));
  const selected: BubutInvoiceSnapshot["pictures"] = [];
  const seen = new Set<string>();

  for (const url of beforeUrls) {
    const picture = byUrl.get(url);
    if (!picture || seen.has(`before:${url}`)) continue;
    selected.push({ ...picture, caption: "BEFORE" });
    seen.add(`before:${url}`);
  }

  for (const url of afterUrls) {
    const picture = byUrl.get(url);
    if (!picture || seen.has(`after:${url}`)) continue;
    selected.push({ ...picture, caption: "AFTER" });
    seen.add(`after:${url}`);
  }

  return selected.length > 0 ? selected : pictures;
}

export interface BubutInvoiceService {
  listWorkOrders(
    session: WebSession,
    query: BubutInvoiceWorkOrderQuery,
  ): Promise<ListResult>;
  buildInvoicePreview(
    session: WebSession,
    params: {
      sourceWoId: string;
      invoiceType: BubutInvoiceType;
      salesInvoiceDate?: string;
      poNo?: string | null;
      poDate?: string | null;
      roundingStep?: number;
      mergedWoIds?: string[];
      materialOverrides?: Array<{ materialName: string; qty: number; price: number }>;
    },
  ): Promise<BubutInvoiceSnapshot>;
  releaseInvoice(
    session: WebSession,
    input: BubutInvoiceReleaseRequest,
  ): Promise<{ invoiceId: number; invoiceNo: string; invoiceType: BubutInvoiceType }>;
  updateInvoice(
    session: WebSession,
    invoiceId: number,
    input: BubutInvoiceUpdateRequest,
  ): Promise<{ invoiceId: number; status: "UPDATED" }>;
  getInvoice(session: WebSession, invoiceId: number): Promise<BubutInvoiceSnapshot | null>;
  getWorkHistory(session: WebSession, sourceKey: string): Promise<BubutInvoiceWorkHistory>;
  cancelInvoice(
    session: WebSession,
    invoiceId: number,
    input: BubutInvoiceCancelRequest,
  ): Promise<{ invoiceId: number; status: "CANCELLED" }>;
  buildPrintView(session: WebSession, invoiceId: number): Promise<BubutInvoiceSnapshot | null>;
}

export class DefaultBubutInvoiceService implements BubutInvoiceService {
  constructor(
    private readonly repository: BubutInvoiceRepository = new MySqlBubutInvoiceRepository(),
    private readonly auditService: AuditService = new DefaultAuditService(
      new MySqlAuditRepository(),
    ),
  ) {}

  async listWorkOrders(
    session: WebSession,
    query: BubutInvoiceWorkOrderQuery,
  ): Promise<ListResult> {
    const result = await this.repository.findCompletedBubutWorkOrders({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      query,
    });

    return {
      data: result.rows,
      meta: buildMeta(query.page, query.limit, result.total),
      query,
    };
  }

  async buildInvoicePreview(
    session: WebSession,
    params: {
      sourceWoId: string;
      invoiceType: BubutInvoiceType;
      salesInvoiceDate?: string;
      poNo?: string | null;
      poDate?: string | null;
      roundingStep?: number;
      mergedWoIds?: string[];
      materialOverrides?: Array<{ materialName: string; qty: number; price: number }>;
    },
  ): Promise<BubutInvoiceSnapshot> {
    const source = await this.repository.findWorkOrderSource({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      sourceWoId: params.sourceWoId,
    });

    if (!source) {
      throw new Error("BUBUT_WO_NOT_FOUND");
    }

    const woIds = [params.sourceWoId, ...(params.mergedWoIds ?? [])];
    
    let combinedProcessDetailText = source.processDetailText ?? "";
    const workingSource: Array<Awaited<ReturnType<BubutInvoiceRepository["findActualWorkingHoursByWo"]>>[number]> = [];
    const materialSource: Array<Awaited<ReturnType<BubutInvoiceRepository["findWarehouseMaterialsByWo"]>>[number]> = [];
    const pictures: Array<Awaited<ReturnType<BubutInvoiceRepository["findPicturesByWo"]>>[number]> = [];

    for (const woId of woIds) {
      const [w, m, p] = await Promise.all([
        this.repository.findActualWorkingHoursByWo(woId),
        this.repository.findWarehouseMaterialsByWo(woId),
        this.repository.findPicturesByWo(woId),
      ]);
      workingSource.push(...w);
      materialSource.push(...m);
      pictures.push(...p);

      if (woId !== params.sourceWoId) {
        const otherSource = await this.repository.findWorkOrderSource({
          employeeId: session.user.employeeId,
          scope: session.user.scope,
          sourceWoId: woId,
        });
        if (otherSource?.processDetailText) {
          combinedProcessDetailText += combinedProcessDetailText ? ` + ${otherSource.processDetailText}` : otherSource.processDetailText;
        }
      }
    }

    const workingHours = workingSource.map((line, index) => {
      const workMinutes = Math.round(line.workingHourDecimal * 60);
      const powerWatt = line.workingHourDecimal > 0 ? 7500 : 0;
      const powerCostKwh = line.workingHourDecimal > 0 ? 1444 : 0;

      return {
        no: index + 1,
        date: line.workDate,
        start: line.start,
        break: minutesToHourText(Math.round(line.breakHours * 60)),
        finish: line.finish,
        workingHourText: minutesToHourText(workMinutes),
        workingHourDecimal: line.workingHourDecimal,
        powerWatt,
        powerCostKwh,
        total: calculateWorkingHourTotal(
          line.workingHourDecimal,
          powerWatt,
          powerCostKwh,
        ),
        actualId: line.actualId,
      };
    });

    const materials = params.materialOverrides
      ? params.materialOverrides.map((line, index) => ({
          no: index + 1,
          materialName: line.materialName,
          qty: line.qty,
          unit: null,
          price: line.price,
          total: line.qty * line.price,
          warehouseTransactionId: null,
          stockCardId: null,
        }))
      : materialSource.length > 0
        ? materialSource.map((line, index) => ({
            no: index + 1,
            materialName: line.materialName,
            qty: line.qty,
            unit: line.unit,
            price: line.price,
            total: line.total,
            warehouseTransactionId: line.warehouseTransactionId,
            stockCardId: line.stockCardId,
          }))
        : [
            {
              no: 1,
              materialName: "TIDAK MEMAKAI BAHAN",
              qty: 0,
              unit: null,
              price: 0,
              total: 0,
              warehouseTransactionId: null,
              stockCardId: null,
            },
          ];

    const totals = buildBubutInvoiceTotals({
      invoiceType: params.invoiceType,
      workingHours,
      materials,
      roundingStep: params.roundingStep ?? 1000,
    });

    return {
      invoiceNo: null,
      invoiceType: params.invoiceType,
      status: "RELEASED",
      salesInvoiceDate: params.salesInvoiceDate ?? todayDate(),
      woDate: source.woDate,
      sourceWoId: source.sourceWoId,
      sourceWobNo: source.sourceWobNo,
      headProjectName: source.headProjectName,
      poNo: params.poNo ?? null,
      poDate: params.poDate ?? null,
      carId: source.carId,
      carType: source.carType,
      sparepartName: source.sparepartName,
      qty: source.qty,
      qtyUnit: source.qtyUnit,
      operatorName: source.operatorName,
      divisionName: source.divisionName,
      processDetailText: combinedProcessDetailText,
      materials,
      workingHours,
      pictures,
      totals,
      sourceSnapshot: {
        source: "WO_BUBUT",
        mergedWoIds: params.mergedWoIds ?? [],
        sourceWoId: source.sourceWoId,
        sourceWobNo: source.sourceWobNo,
        carId: source.carId,
        carType: source.carType,
        headProjectName: source.headProjectName,
        operatorName: source.operatorName,
        divisionName: source.divisionName,
        generatedFrom: {
          wo: true,
          actual: workingSource.length > 0,
          warehouse: materialSource.length > 0,
          gallery: pictures.length > 0,
        },
      },
    };
  }

  async getWorkHistory(
    session: WebSession,
    sourceKey: string,
  ): Promise<BubutInvoiceWorkHistory> {
    const source = await this.repository.findWorkOrderSource({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      sourceWoId: sourceKey,
    });

    if (!source) {
      throw new Error("BUBUT_WO_NOT_FOUND");
    }

    const [workSource, materialSource, invoiceIds] = await Promise.all([
      this.repository.findWorkHistoryRowsByWo(source.sourceWoId),
      this.repository.findWarehouseMaterialsByWo(source.sourceWoId),
      this.repository.findActiveInvoiceIdsBySourceWoId(source.sourceWoId),
    ]);

    const workRows = workSource.map((line) => {
      const workMinutes = decimalHoursToMinutes(line.workingHourDecimal);
      const powerWatt = line.workingHourDecimal > 0 ? 7500 : 0;
      const powerCostKwh = line.workingHourDecimal > 0 ? 1444 : 0;

      return {
        id: line.id,
        workDate: line.workDate,
        startTime: line.startTime,
        breakTime: minutesToHourText(Math.round(line.breakHours * 60)),
        finishTime: line.finishTime,
        workingHourText: minutesToHourText(workMinutes),
        workingHourDecimal: line.workingHourDecimal,
        resultStatus: line.resultStatus,
        operatorName: line.operatorName,
        panelPartName: line.panelPartName,
        jobdesc: line.jobdesc,
        processDetail: line.processDetail,
        documentationUrls: line.documentationUrls,
        powerWatt,
        powerCostKwh,
        workingHourCost: calculateWorkingHourTotal(
          line.workingHourDecimal,
          powerWatt,
          powerCostKwh,
        ),
      };
    });

    const materialRows = materialSource.map((line, index) => ({
      id: line.warehouseTransactionId ?? line.stockCardId ?? `${source.sourceWoId}:material:${index + 1}`,
      materialName: line.materialName,
      qty: line.qty,
      quom: line.unit,
      price: line.price,
      total: line.total,
      sourceTransactionId: line.warehouseTransactionId ?? line.stockCardId ?? null,
    }));

    const totalsSource = buildBubutInvoiceTotals({
      invoiceType: "CUSTOMER",
      workingHours: workRows.map((line, index) => ({
        no: index + 1,
        date: line.workDate ?? "",
        start: line.startTime,
        break: line.breakTime,
        finish: line.finishTime,
        workingHourText: line.workingHourText,
        workingHourDecimal: line.workingHourDecimal,
        powerWatt: line.powerWatt,
        powerCostKwh: line.powerCostKwh,
        total: line.workingHourCost,
      })),
      materials: materialRows.map((line, index) => ({
        no: index + 1,
        materialName: line.materialName,
        qty: line.qty,
        unit: line.quom,
        price: line.price,
        total: line.total,
      })),
      roundingStep: 1000,
    });

    const invoiceStatus =
      invoiceIds.direksiInvoiceId && invoiceIds.customerInvoiceId
        ? "BOTH_RELEASED"
        : invoiceIds.direksiInvoiceId
          ? "DIREKSI_RELEASED"
          : invoiceIds.customerInvoiceId
            ? "CUSTOMER_RELEASED"
            : "NO_INVOICE";

    return {
      sourceKey: source.sourceWoId,
      header: {
        woId: source.sourceWoId,
        wobNo: source.sourceWobNo,
        woDate: source.woDate,
        teamName: source.headProjectName,
        carId: source.carId,
        carName: source.carType,
        divisionName: source.divisionName,
        operatorName: source.operatorName,
        sparepartName: source.sparepartName,
        qtyLabel: source.qty === null
          ? null
          : `${source.qty}${source.qtyUnit ? ` ${source.qtyUnit}` : ""}`,
        jobdesc: source.processDetailText,
        invoiceStatus,
        direksiInvoiceId: invoiceIds.direksiInvoiceId,
        customerInvoiceId: invoiceIds.customerInvoiceId,
      },
      workRows,
      materialRows,
      totals: {
        totalWorkingHourText: totalsSource.totalWorkHourText,
        totalWorkingHourDecimal: totalsSource.totalWorkHourDecimal,
        totalWorkingHourCost: totalsSource.workingHourTotal,
        totalMaterial: totalsSource.materialTotal,
        totalBasePrice: totalsSource.totalPriceBubut,
        customerUpTotal: totalsSource.priceAfterMarkup ?? 0,
        customerRoundedTotal: totalsSource.priceRounding ?? 0,
      },
    };
  }

  async releaseInvoice(session: WebSession, input: BubutInvoiceReleaseRequest) {
    const preview = await this.buildInvoicePreview(session, input);
    const activeInvoice = await this.repository.findActiveInvoiceBySource(
      preview.sourceWobNo,
      input.invoiceType,
    );

    if (activeInvoice) {
      throw new Error("BUBUT_INVOICE_ALREADY_RELEASED");
    }

    const [year, month] = input.salesInvoiceDate.split("-");
    const sequence = await this.repository.getNextInvoiceSequence(month, year);
    const invoiceNo = formatInvoiceNo(input.salesInvoiceDate, sequence);
    const selectedPictures = buildSelectedInvoicePictures(
      preview.pictures,
      input.beforePictureUrls,
      input.afterPictureUrls,
    );
    const snapshot: BubutInvoiceSnapshot = {
      ...preview,
      invoiceNo,
      pictures: selectedPictures,
      sourceSnapshot: {
        ...preview.sourceSnapshot,
        selectedPictures: {
          before: input.beforePictureUrls,
          after: input.afterPictureUrls,
        },
      },
      releasedBy: session.user.employeeId,
      releasedByName: session.user.fullName,
    };

    try {
      const result = await this.repository.insertInvoice(snapshot);
      await this.auditService.log({
        actorId: session.user.employeeId,
        actorName: session.user.fullName,
        action: "bubut_invoice.release",
        module: "bubut_invoice",
        recordId: String(result.invoiceId),
        newValue: {
          invoiceNo,
          invoiceType: input.invoiceType,
          sourceWoId: input.sourceWoId,
          sourceWobNo: snapshot.sourceWobNo,
          totals: snapshot.totals,
        },
      });

      return {
        invoiceId: result.invoiceId,
        invoiceNo: result.invoiceNo,
        invoiceType: input.invoiceType,
      };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "ER_DUP_ENTRY"
      ) {
        throw new Error("BUBUT_INVOICE_ALREADY_RELEASED");
      }

      throw error;
    }
  }

  async updateInvoice(session: WebSession, invoiceId: number, input: BubutInvoiceUpdateRequest) {
    const existing = await this.getInvoice(session, invoiceId);
    if (!existing) {
      throw new Error("BUBUT_INVOICE_NOT_FOUND");
    }

    if (existing.status !== "RELEASED") {
      throw new Error("BUBUT_INVOICE_INVALID_STATE");
    }

    // Re-build preview to get all current photos and possible material/WO updates
    const preview = await this.buildInvoicePreview(session, {
      sourceWoId: existing.sourceWoId,
      invoiceType: existing.invoiceType,
      salesInvoiceDate: input.salesInvoiceDate,
      poNo: input.poNo,
      poDate: input.poDate,
      roundingStep: input.roundingStep,
      mergedWoIds: input.mergedWoIds,
      materialOverrides: input.materialOverrides,
    });

    const selectedPictures = buildSelectedInvoicePictures(
      preview.pictures,
      input.beforePictureUrls,
      input.afterPictureUrls,
    );

    const snapshot: BubutInvoiceSnapshot = {
      ...existing,
      salesInvoiceDate: input.salesInvoiceDate,
      poNo: input.poNo ?? null,
      poDate: input.poDate ?? null,
      processDetailText: preview.processDetailText,
      workingHours: preview.workingHours,
      materials: preview.materials,
      totals: preview.totals,
      pictures: selectedPictures,
      sourceSnapshot: {
        ...existing.sourceSnapshot,
        mergedWoIds: input.mergedWoIds ?? [],
        selectedPictures: {
          before: input.beforePictureUrls,
          after: input.afterPictureUrls,
        },
      },
    };

    const updated = await this.repository.updateInvoice(
      invoiceId,
      snapshot,
      session.user.employeeId,
      session.user.fullName,
    );

    if (!updated) {
      throw new Error("BUBUT_INVOICE_INVALID_STATE");
    }

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "bubut_invoice.update",
      module: "bubut_invoice",
      recordId: String(invoiceId),
      oldValue: {
        salesInvoiceDate: existing.salesInvoiceDate,
        poNo: existing.poNo,
        poDate: existing.poDate,
        pictures: existing.pictures.length,
      },
      newValue: {
        salesInvoiceDate: snapshot.salesInvoiceDate,
        poNo: snapshot.poNo,
        poDate: snapshot.poDate,
        pictures: snapshot.pictures.length,
      },
    });

    return {
      invoiceId,
      status: "UPDATED" as const,
    };
  }

  async getInvoice(session: WebSession, invoiceId: number) {
    return this.repository.findInvoiceById({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      invoiceId,
    });
  }

  async cancelInvoice(
    session: WebSession,
    invoiceId: number,
    input: BubutInvoiceCancelRequest,
  ) {
    const invoice = await this.getInvoice(session, invoiceId);
    if (!invoice) {
      throw new Error("BUBUT_INVOICE_NOT_FOUND");
    }

    const updated = await this.repository.cancelInvoice({
      invoiceId,
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      reason: input.reason,
    });

    if (!updated) {
      throw new Error("BUBUT_INVOICE_INVALID_STATE");
    }

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "bubut_invoice.cancel",
      module: "bubut_invoice",
      recordId: String(invoiceId),
      oldValue: {
        invoiceNo: invoice.invoiceNo,
        status: invoice.status,
      },
      newValue: {
        status: "CANCELLED",
        reason: input.reason,
      },
    });

    return {
      invoiceId,
      status: "CANCELLED" as const,
    };
  }

  async buildPrintView(session: WebSession, invoiceId: number) {
    const invoice = await this.getInvoice(session, invoiceId);
    if (invoice) {
      await this.repository.markPrinted(invoiceId);
    }
    return invoice;
  }
}
