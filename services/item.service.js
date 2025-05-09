// services/item.service.js
/* ------------------------------------------------------------------
   Single-source of truth for creating Items.
   – NO external BomRow collection any more – BOM is embedded
------------------------------------------------------------------- */
import mongoose from 'mongoose';
import connectMongoDB from '@/lib/index';
import { Item } from '@/models/Item';

/**
 * Create a Chemical, Solution or Product.
 *
 * @param {Object} payload
 *   @property {'chemical'|'solution'|'product'} itemType
 *   @property {String}  sku
 *   @property {String}  displayName
 *   @property {Boolean} [lotTracked=false]
 *   @property {String}  [uom='ea']
 *   @property {Number}  [qtyOnHand=0]
 *   @property {Array<{componentId,quantity,uom}>} [bom=[]]  // solution/product only
 *
 * @returns {Promise<Item>} newly-created Item document
 */
export async function createItem (payload, session = null) {
  await connectMongoDB();

  const {
    itemType,
    sku,
    displayName,
    lotTracked = false,
    uom        = 'ea',
    qtyOnHand  = 0,
    bom        = []
  } = payload;

  /* open a txn if the caller didn't give us one */
  const ownSession = !session;
  if (ownSession) session = await mongoose.startSession();

  try {
    if (ownSession) session.startTransaction();

    /* build the base object */
    const docData = {
      itemType,
      sku,
      displayName,
      lotTracked,
      uom,
      qtyOnHand
    };

    /* embed BOM rows for solution / product */
    if ((itemType === 'solution' || itemType === 'product') && Array.isArray(bom) && bom.length) {
      docData.bom = bom.map(r => ({
        componentId : r.componentId,
        quantity    : Number(r.quantity),
        uom         : r.uom || 'ea'
      }));
    }

    const [created] = await Item.create([docData], { session });

    if (ownSession) await session.commitTransaction();
    return created;

  } catch (err) {
    if (ownSession) await session.abortTransaction();
    throw err;
  } finally {
    if (ownSession) session.endSession();
  }
}
