-- description: Pindahkan data sementara weekly planning ke Redis
--
-- DB dipakai untuk record/histori operasional. Dua tabel berikut hanya cache/snapshot
-- turunan yang sekarang disimpan di Redis:
-- - planning:weekly:capacity:{planId}
-- - planning:weekly:absence-loss:{planId}

DROP TABLE IF EXISTS `sm_weekly_plan_capacity_cache`;
DROP TABLE IF EXISTS `sm_weekly_plan_absence_snapshot`;
