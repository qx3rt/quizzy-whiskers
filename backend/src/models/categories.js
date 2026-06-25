import { getAllQuery } from '../db/database.js'

// Returns topic areas with the count of Cluebase categories mapped to each group.
export async function getTopicAreas() {
  return getAllQuery(`
    SELECT cg.slug AS id,
           cg.slug AS slug,
           COUNT(cgm.id)::int AS category_count
    FROM category_groups cg
    JOIN category_group_mappings cgm ON cgm.category_group_id = cg.id
    GROUP BY cg.slug
    ORDER BY cg.slug
  `)
}
