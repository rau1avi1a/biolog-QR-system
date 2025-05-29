export interface InventoryTxnDTO {
    id:        string
    txnType:   'receipt' | 'issue' | 'adjustment' | 'build'
    postedAt:  string
    memo?:     string
    project?:  string
    department?: string
    createdBy: { name:string; _id:string; email?:string }
    lines:     { item:string; lot?:string; qty:number }[]
  }
  