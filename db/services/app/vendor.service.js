import connectMongoDB from "@/db/index";
import { Vendor }     from "@/db/schemas/Vendor";
import { VendorItem } from "@/db/schemas/VendorItem";

export const vendorService = {
  async list() {
    await connectMongoDB();
    return await Vendor.find().lean();
  },

  async get(id) {
    await connectMongoDB();
    return await Vendor.findById(id).lean();
  },

  async create(data) {
    await connectMongoDB();
    return (await Vendor.create(data)).toObject();
  },

  async linkItem(vendorId, itemId, payload) {
    await connectMongoDB();
    const doc = await VendorItem.findOneAndUpdate(
      { vendor: vendorId, item: itemId },
      { ...payload, vendor: vendorId, item: itemId },
      { upsert:true, new:true, setDefaultsOnInsert:true }
    ).lean();
    return doc;
  },

  async sourcesForItem(itemId) {
    await connectMongoDB();
    return await VendorItem.find({ item: itemId })
      .populate('vendor')
      .sort({ preferred:-1, 'vendor.name':1 })
      .lean();
  }
};
