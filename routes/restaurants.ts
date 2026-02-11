import express from "express"
import { validate } from "../middlewares/validate.js"
import { Restaurant, RestaurantSchema } from "../schemas/restaurant.js"
import { initializeRedisClient } from "../utils/client.js"
import { nanoid } from "nanoid"
import { restaurantKeyById } from "../utils/keys.js"
import { successResponse } from "../utils/responses.js"
import { Request } from "express"
import { checkRestaurantExists } from "../middlewares/checkRestaurantId.js"
const router  = express.Router()
router.post("/", validate(RestaurantSchema),async(req, res, next)=> {
  const data = req.body as Restaurant
  try { 
  const client = await initializeRedisClient();
  const id = nanoid()
  const restaurantKey = restaurantKeyById(id)
  // Hashes in redis allow you to store objects. Accpet that it is of depth 1. Which basically means that there can be no hash with in a hash and no array with in a hash. And hence dept or degree of 1
  const hashData = {id, name: data.name, location: data.location};
  // first argument that this hset or hash set accepts is the key, and then the value which should be a hash. 
  const addResult = await client.hSet(restaurantKey, hashData)
  console.log(`Added ${addResult}`)
  return successResponse(res, hashData, "Added new restaurant")

  } catch (error) {
    next(error)
  }
})
router.get("/:restaurantId",checkRestaurantExists,  async (req: Request<{restaurantId: string}>, res, next )=> {
  const {restaurantId} = req.params
  try {
    const client = await initializeRedisClient()
    const restaurantKey = restaurantKeyById(restaurantId)
    // this is hGetAll because if you use hGet, it give only the specified field from a hash map while the getAll returns every single field of the given hash
    // increment the view count by 1 so to keep track of how many times a specific hash is accessed. Not good in production
    // VIEWCOUNT CALCULATION IS NOT GOOD FOR PRODUCTION
    const [_,restaurant] = await Promise.all([client.hIncrBy(restaurantKey,"viewCount", 1),client.hGetAll(restaurantKey)])
    console.log(restaurantKey)
    console.log(restaurant)
    return successResponse(res, restaurant)
  } catch (error) {
    next(error)
  }
})
export default router
