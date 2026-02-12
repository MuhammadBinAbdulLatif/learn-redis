import express from "express"
import { validate } from "../middlewares/validate.js"
import { Restaurant, RestaurantSchema } from "../schemas/restaurant.js"
import { initializeRedisClient } from "../utils/client.js"
import { nanoid } from "nanoid"
import { cuisineKey, cuisinesKey, restaurantByRatingKey, restaurantCuisinesKeyById, restaurantKeyById, reviewDetailsKeyById, reviewKeyById, weatherKeyById } from "../utils/keys.js"
import { errorResponse, successResponse } from "../utils/responses.js"
import { Request } from "express"
import { checkRestaurantExists } from "../middlewares/checkRestaurantId.js"
import { Review, ReviewSchema } from "../schemas/reviews.js"
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
   await Promise.all([
  ...data.cuisines.map(cuisine => Promise.all([
    client.sAdd(cuisinesKey, cuisine),
    client.sAdd(cuisineKey(cuisine), id),
    client.sAdd(restaurantCuisinesKeyById(id), cuisine)
  ])),
  client.hSet(restaurantKey, hashData),
   client.zAdd(restaurantByRatingKey, {
     score: 0,
     value: id
   })])
  return successResponse(res, hashData, "Added new restaurant")

  } catch (error) {
    next(error)
  }
})

router.get("/:restaurantId/weather", checkRestaurantExists, async(req: Request<{restaurantId: string}>, res, next)=> {
  const {restaurantId} = req.params
  try {
    const client = await initializeRedisClient()
    const weatherKey = weatherKeyById(restaurantId)
    const cachedWeather = await client.get(weatherKey)
    if (cachedWeather) {
      console.log("The cache was hit")
      return successResponse(res, JSON.parse(cachedWeather));
    }
    const restaurantKey = restaurantKeyById(restaurantId)
    const coords = await client.hGet(restaurantKey, "location")
    if (!coords) {
      return errorResponse(res, 404, "Coordinates have not been found")

    }
    const [lng, lat] = coords.split(',')
    const apiResponse = await fetch(`https://api.openweathermap.org/data/3.0/onecall?units=imperial&lat=${lat}&lon=${lng}&appid=${process.env.WEATHER_API_KEY}`)
    console.log(apiResponse)
    if(apiResponse.status === 200) {
      const json = await apiResponse.json()
      await client.set(weatherKey, JSON.stringify(json))
      return successResponse(res, json)
    }
    return errorResponse(res, 500, "Couldn't fetch weather info")
  } catch (error) {
    next(error)
  }
})

router.post("/:restaurantId/reviews", checkRestaurantExists, validate(ReviewSchema), async (req: Request<{restaurantId: string}>, res, next) => {
  const {restaurantId} = req.params
  const data = req.body as Review
  try {
    const restaurantkey= restaurantKeyById(restaurantId) 
    const client = await initializeRedisClient()
    const reviewId = nanoid()
    const reviewKey = reviewKeyById(restaurantId)
    const reviewDetailsKey = reviewDetailsKeyById(reviewId)
    const reviewData = {
      id: reviewId, ...data, timestam: Date.now(), restaurantId
    }
    const [review_count, setResult, totalStars] = await Promise.all([client.lPush(reviewKey, reviewId), client.hSet(reviewDetailsKey, reviewData),
    client.hIncrByFloat(restaurantkey,"totalStars", data.rating)])
    const averageRating = Number((totalStars as any / review_count).toFixed(1))
    await Promise.all([
      client.zAdd(restaurantByRatingKey, {
        score: averageRating,
        value: restaurantId
      }),
      client.hSet(restaurantkey, "avgStars", averageRating),
    ])
    return successResponse(res,  reviewData, "Successfully created a review" )
  } catch(error) {
    next(error)
  }
})

router.get("/:restaurantId/reviews", checkRestaurantExists, async (req: Request<{restaurantId: string}>, res, next)=> {
  const {restaurantId} = req.params

  const {page = 1, limit = 10} = req.query

  const start = (Number(page) - 1) * Number(limit)
  const end = start + Number(limit) -1
  try {
    const client = await initializeRedisClient()
    const reviewKey = reviewKeyById(restaurantId)
    const reviewIds = await client.lRange(reviewKey, start, end)
    const reviews = await Promise.all(reviewIds.map(id => {
      console.log(reviewDetailsKeyById(id))
      return client.hGetAll(reviewDetailsKeyById(id))
    }))
    return successResponse(res, reviews);
  } catch (error) {
    next(error)
  }
})

router.get("/", async(req, res, next)=> {
  const {page =1, limit = 10} = req.query;
  const start = (Number(page) -1) * Number(limit)
  const end = start + Number(limit)
  try {
    const client = await initializeRedisClient()
    const restaurantIds = await client.zRange(restaurantByRatingKey, start, end, {
      REV: true
    })
    const restaurant  = await Promise.all(restaurantIds.map(id => client.hGetAll(restaurantKeyById(id))))
    return successResponse(res,restaurant)
  } catch (error) {
    next(error)
  }
})

router.delete("/:restaurantId/reviews/:reviewId", checkRestaurantExists, async (req: Request<{restaurantId:string, reviewId: string}>, res, next)=> {
  const {restaurantId, reviewId} = req.params
  try {
    const client = await initializeRedisClient()
    const reviewKey = reviewKeyById(restaurantId)
    const reviewDetailsKey = reviewDetailsKeyById(reviewId)
    const [removeResult, deleteResult] = await Promise.all([
      client.lRem(reviewKey, 0, reviewId ),
      client.del(reviewDetailsKey)
    ])
    if(removeResult === 0 && deleteResult === 0) {
      return errorResponse(res, 404, "Review Not Found")
    }
    return successResponse(res, reviewId, "Review Deleted")
  } catch (error) {
    next(error)
  }
} )

router.get("/:restaurantId",checkRestaurantExists,  async (req: Request<{restaurantId: string}>, res, next )=> {
  const {restaurantId} = req.params
  try {
    const client = await initializeRedisClient()
    const restaurantKey = restaurantKeyById(restaurantId)
    // this is hGetAll because if you use hGet, it give only the specified field from a hash map while the getAll returns every single field of the given hash
    // increment the view count by 1 so to keep track of how many times a specific hash is accessed. Not good in production
    // VIEWCOUNT CALCULATION IS NOT GOOD FOR PRODUCTION
    const [_,restaurant, cuisines] = await Promise.all([client.hIncrBy(restaurantKey,"viewCount", 1),client.hGetAll(restaurantKey), client.sMembers(restaurantCuisinesKeyById(restaurantId))])
    console.log(cuisines)
    return successResponse(res, {...restaurant, cuisines})
  } catch (error) {
    next(error)
  }
})

export default router
