// services/archive.service.js   (new tiny helper)
import Folder from '@/models/Folder';
import File   from '@/models/File';
import { ObjectId } from 'mongoose';

export async function createArchiveCopy(batch) {
   const mother   = await File.findById(batch.fileId).lean();
   if (!mother) return;

   /* 1 — find / create “Archive” root folder */
   let root = await Folder.findOne({ name:'Archive', parentId:null });
   if (!root) root = await Folder.create({ name:'Archive', parentId:null });

   /* 2 — recreate folder chain under /Archive */
   let parent = root._id;
   if (mother.folderId) {
      const chain = await Folder.find({ _id: mother.folderId }).lean().then(buildChain);
      for (const dir of chain) {
        let f = await Folder.findOne({ name:dir.name, parentId:parent });
        if (!f) f = await Folder.create({ name:dir.name, parentId:parent });
        parent = f._id;
      }
   }

   /* 3 — write one immutable PDF copy */
   await File.create({
      fileName : mother.fileName.replace('.pdf', `-Run-${batch.runNumber}.pdf`),
      folderId : parent,
      pdf      : { data: Buffer.from(batch.finalPdf, 'base64') },
      // any readonly fields you want to keep
   });
}
/* helper that climbs up folder parents → returns root-down array */
function buildChain(doc) {/* … */}
