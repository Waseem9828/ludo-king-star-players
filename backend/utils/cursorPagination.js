import mongoose from "mongoose";

/**
 * Executes a cursor-based pagination query using _id or custom sort key.
 * Fast O(log N) lookup regardless of page depth.
 * 
 * @param {mongoose.Model} model - Mongoose Model
 * @param {Object} filter - Filter query object
 * @param {Object} options - Pagination options
 * @param {string} [options.cursor] - The cursor string (usually base64 encoded _id or raw ID)
 * @param {number} [options.limit=20] - Number of items to fetch
 * @param {Object} [options.sort={ _id: -1 }] - Sort direction (-1 for descending, 1 for ascending)
 * @param {string} [options.select] - Mongoose select fields
 * @param {Array|Object} [options.populate] - Mongoose populate fields
 * @returns {Promise<{ items: Array, nextCursor: string|null, hasMore: boolean }>}
 */
export async function paginateWithCursor(model, filter = {}, options = {}) {
  const limit = Math.min(Math.max(parseInt(options.limit) || 20, 1), 100);
  const sortDirection = options.sort?._id === 1 ? 1 : -1;
  const cursor = options.cursor;

  const queryFilter = { ...filter };

  if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
    const operator = sortDirection === -1 ? "$lt" : "$gt";
    queryFilter._id = { [operator]: new mongoose.Types.ObjectId(cursor) };
  }

  let query = model.find(queryFilter).sort({ _id: sortDirection }).limit(limit + 1).lean();

  if (options.select) {
    query = query.select(options.select);
  }

  if (options.populate) {
    query = query.populate(options.populate);
  }

  const results = await query;
  const hasMore = results.length > limit;
  const items = hasMore ? results.slice(0, limit) : results;

  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]._id.toString() : null;

  return {
    items,
    nextCursor,
    hasMore,
    count: items.length
  };
}
