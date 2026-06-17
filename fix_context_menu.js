const fs = require('fs');
const file = '/home/sahrulr/Documents/SM-MIS/smsystem/apps/web/modules/units/components/bom-tracker-tab.tsx';
let content = fs.readFileSync(file, 'utf8');

const ctxMenuStart = content.indexOf('const ctxRecord = contextMenu.node.panelId');
if (ctxMenuStart === -1) {
  content = content.replace(
    /className="absolute z-50 min-w-\[180px\] border border-white\/10 bg-\[\#111114\]\/95 shadow-xl shadow-black\/40 backdrop-blur"[\s\S]*?<div className="border-b border-white\/10 px-3 py-2">/,
    `className="absolute z-50 min-w-[180px] border border-white/10 bg-[#111114]/95 shadow-xl shadow-black/40 backdrop-blur"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {(() => {
              const ctxRecord = contextMenu.node.panelId ? recordsById.get(contextMenu.node.panelId) ?? null : null;
              const ctxDetailKey = panelDetailKey(contextMenu.node);
              return (
                <>
                  <div className="border-b border-white/10 px-3 py-2">`
  );
  
  content = content.replace(
    /Hide node\s*<\/button>/,
    `Hide node
            </button>
            {canManagePanels && ctxRecord ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    openEdit(ctxRecord);
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2 border-t border-white/10 px-2 py-2 text-left text-[11px] font-mono text-white/65 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit {ctxRecord.nodeType === "PANEL" ? "panel" : "part"}
                </button>
                {ctxRecord.nodeType === "PANEL" ? (
                  <button
                    type="button"
                    onClick={() => {
                      openCreateFromNode(contextMenu.node);
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-2 px-2 py-2 text-left text-[11px] font-mono text-amber-500/80 transition-colors hover:bg-amber-500/10 hover:text-amber-400"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Tambah part
                  </button>
                ) : null}
              </>
            ) : null}
            {ctxDetailKey ? (
              <button
                type="button"
                onClick={() => {
                  navigateToDetail(contextMenu.node);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 border-t border-white/10 px-2 py-2 text-left text-[11px] font-mono text-white/65 transition-colors hover:bg-white/[0.05] hover:text-white"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Buka detail workflow
              </button>
            ) : null}`
  );
  
  content = content.replace(
    /Reset size\s*<\/button>\s*\)\s*:\s*null\}\s*<\/div>\s*\)\s*:\s*null\}/,
    `Reset size
              </button>
            ) : null}
                </>
              );
            })()}
          </div>
        ) : null}`
  );
}

fs.writeFileSync(file, content);
