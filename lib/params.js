// @lib/params.js
export const getIdsFromContext = async (context) => {
    const params = await context.params;
    const { id, lotId } = params;
  
    if (!id) {
      throw new Error("Product ID is missing in the route parameters.");
    }
  
    if (!lotId) {
      throw new Error("Lot ID is missing in the route parameters.");
    }
  
    return { id, lotId };
  };
  