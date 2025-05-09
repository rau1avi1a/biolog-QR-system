// app/home/page.jsx
import { Item }  from '@/models/Item';
import dbConnect from '@/lib/index';
import ClientTabs from './clienttabs';

export default async function HomePage() {
  await dbConnect();

  /* pull and flatten to plain JSON */
  const raw = await Item.find().lean();
  const flat = raw.map(d => ({
    ...d,
    _id      : d._id.toString(),                 // <- stringify
    createdAt: d.createdAt?.toISOString?.(),
    updatedAt: d.updatedAt?.toISOString?.(),
  }));

  const groups = { chemical: [], solution: [], product: [] };
  flat.forEach(i => { groups[i.itemType]?.push(i); });

  return <ClientTabs groups={groups} />;
}
