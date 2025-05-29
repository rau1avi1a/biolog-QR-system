// /types/item.d.ts
export interface ItemDTO {
    id:          string;
    sku:         string;
    displayName: string;
    itemType:    "chemical" | "machine_part" | "solution" | "product";
    uom:         string;
    qtyOnHand:   number;
    lots?: { LotNumber:string; Quantity:number; Expiry?:string }[];
  }
  