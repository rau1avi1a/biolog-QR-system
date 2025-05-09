import connectMongoDB   from "@/lib/index";
import { PurchaseOrder } from "@/models/PurchaseOrder";
import { Item }         from "@/models/Item";
import { txnService } from "./txn.service";

export const poService = {
  async list() {
    await connectMongoDB();
    return PurchaseOrder.find().populate('vendor').lean();
  },

  async get(id) {
    await connectMongoDB();
    return PurchaseOrder.findById(id).populate('vendor').lean();
  },

  async create(data) {
    await connectMongoDB();
    return (await PurchaseOrder.create(data)).toObject();
  },

  async updateStatus(id, status) {
    await connectMongoDB();
    return PurchaseOrder.findByIdAndUpdate(id, { status }, { new:true }).lean();
  },

  /* -------- receipt workflow -------- */
  async receive(id, receiptLines, actor = 'system') {
    // receiptLines: [{ itemId, lotNumber?, qty }]
    await connectMongoDB();
    const po = await PurchaseOrder.findById(id);
    if (!po) throw new Error('PO not found');

    /* 1-2. inventory + event in one call */
    const txn = await txnService.post({
          txnType: 'receipt',
          refDoc : po._id,
          lines  : receiptLines.map(r => ({
            item: r.itemId,
            lot : r.lotNumber,
            qty : r.qty
          })),
          actor,
          memo: `PO receipt`
        });

    /* 3. close or partial */
    const remaining = po.lines.reduce((acc,l)=>{
      const received = receiptLines
        .filter(r=>r.itemId===l.item.toString())
        .reduce((s,r)=>s+r.qty,0);
      return acc + Math.max(0, l.qty - received);
    },0);

    po.status = remaining === 0 ? 'received' : 'partial';
    await po.save();

    return po.toObject();
  }
};
