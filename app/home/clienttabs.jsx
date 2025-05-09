'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tabs, TabsList, TabsTrigger, TabsContent
} from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';

import UploadCSV        from './uploadchem';
import CreateItemDrawer from './create';

export default function ClientTabs({ groups }) {
  const [drawer, setDrawer] = useState({ open:false, type:'chemical' });

  const openDrawer = type => setDrawer({ open:true, type });

  const grid = list => (
    list.length === 0 ? (
      <p className="p-4 text-sm italic text-muted-foreground">
        Nothing in this category
      </p>
    ) : (
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {list.map(it => (
          <Card key={it._id}>
            <CardContent className="p-4 space-y-1">
              <p className="font-medium truncate">{it.displayName}</p>
              <p className="text-xs text-muted-foreground">{it.sku}</p>
              <p className="text-sm">
                On&nbsp;hand:&nbsp;{it.qtyOnHand}&nbsp;{it.uom}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  );

  return (
    <>
      <CreateItemDrawer
        open={drawer.open}
        onOpenChange={o => setDrawer({ ...drawer, open:o })}
        type={drawer.type}
      />

      <div className="p-6">
        <Tabs defaultValue="chemical">
          <TabsList className="mb-6">
            {['chemical','solution','product'].map(k => (
              <TabsTrigger key={k} value={k} className="capitalize">
                {k}s ({groups[k].length})
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Chemicals */}
          <TabsContent value="chemical">
            <div className="mb-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => openDrawer('chemical')}>
                <Plus size={14}/> New chemical
              </Button>
              <UploadCSV/>
            </div>
            <ScrollArea className="h-[calc(100vh-260px)] pr-2">
              {grid(groups.chemical)}
            </ScrollArea>
          </TabsContent>

          {/* Solutions */}
          <TabsContent value="solution">
            <Button variant="outline" size="sm" className="mb-4"
                    onClick={() => openDrawer('solution')}>
              <Plus size={14}/> New solution
            </Button>
            <ScrollArea className="h-[calc(100vh-260px)] pr-2">
              {grid(groups.solution)}
            </ScrollArea>
          </TabsContent>

          {/* Products */}
          <TabsContent value="product">
            <Button variant="outline" size="sm" className="mb-4"
                    onClick={() => openDrawer('product')}>
              <Plus size={14}/> New product
            </Button>
            <ScrollArea className="h-[calc(100vh-260px)] pr-2">
              {grid(groups.product)}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
