interface PurchaseOrderDTO {
    id:        string;
    poNumber:  string;
    status:    'open' | 'partial' | 'received' | 'closed';
    eta?:      string;
    vendor:    { id:string; name:string };
    lines:     { item:string; qty:number; price?:number; uom?:string }[];
    memo?:     string;
  }
  