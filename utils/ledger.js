// Ghi sổ hoàn cọc / thu thêm. amount > 0: shop hoàn khách · amount < 0: khách đền thêm
const { LedgerEntry } = require('../models');

async function post({ key, rentalId = null, amount, reason }, { transaction } = {}) {
  const n = Math.round(Number(amount) || 0);
  if (!n) return null;
  const [entry] = await LedgerEntry.findOrCreate({
    where: { Key: key },
    defaults: { RentalID: rentalId, Direction: n > 0 ? 'out' : 'in', Amount: Math.abs(n), Reason: String(reason || '').slice(0, 255) },
    transaction,
  });
  return entry;
}

module.exports = { post };
