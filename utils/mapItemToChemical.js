// utils/mapItemToChemical.js
export function mapItemToChemical(item) {
    return {
      _id:          item.id,
      BiologNumber: item.sku,
      ChemicalName: item.displayName,
      CASNumber:    item.casNumber  || "",
      Location:     item.location   || "",
      Lots:         (item.lots || []).map(l => ({
        _id:       l.LotNumber,
        LotNumber: l.LotNumber,
        Quantity:  l.Quantity
      })),
      totalQuantity: item.qtyOnHand
    };
  }
  