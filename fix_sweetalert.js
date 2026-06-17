const fs = require('fs');
const file = '/home/sahrulr/Documents/SM-MIS/smsystem/apps/web/modules/units/components/bom-tracker-tab.tsx';
let content = fs.readFileSync(file, 'utf8');

// fix destructuring
content = content.replace('const { alertElement, notifyError, notifySuccess } = useSweetAlert();', 'const { alertElement, notifyError, notifySuccess, confirm } = useSweetAlert();');

// fix toast
content = content.replace(/sweetAlert\.toast\(([^,]+?),\s*"error"\)/g, 'notifyError($1)');
content = content.replace(/sweetAlert\.toast\(([^,]+?),\s*"success"\)/g, 'notifySuccess($1)');

// fix fire (Kategori)
content = content.replace(/const confirmed = await sweetAlert\.fire\(\{[\s\S]*?text: `([^`]+)`[\s\S]*?\}\);/g, (match, desc) => {
  if (desc.includes('kategori')) {
    return `const confirmed = await confirm({ title: "Hapus Kategori?", description: \`${desc}\`, tone: "error", confirmLabel: "Hapus", cancelLabel: "Batal" });`;
  }
  return `const confirmed = await confirm({ title: "Hapus?", description: \`${desc}\`, tone: "error", confirmLabel: "Hapus", cancelLabel: "Batal" });`;
});

// also fix !confirmed.isConfirmed
content = content.replace(/if \(!confirmed\.isConfirmed\)/g, 'if (!confirmed)');

fs.writeFileSync(file, content);
