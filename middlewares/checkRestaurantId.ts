import type { Request, Response, NextFunction} from "express";
import { errorResponse } from "../utils/responses.js";
import { initializeRedisClient } from "../utils/client.js";
import { restaurantKeyById } from "../utils/keys.js";

export const checkRestaurantExists = async (req:Request, res: Response, next: NextFunction) => {
  const {restaurantId} = req.params
  if(!restaurantId) {
    return errorResponse(res, 400, "Restaurant Id was not found")
  }
  const client = await initializeRedisClient()
  const restaurantKey = restaurantKeyById(restaurantId as string)

  const exists = await client.exists(restaurantKey)
  if (!exists) {
    return errorResponse(res, 404, "Restaurant Not Found")
  }
  next()
}
