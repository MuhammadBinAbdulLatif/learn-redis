import type { NextFunction, Request, Response } from "express";
import { errorResponse } from "../responses.js";


export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error(err)

  errorResponse(res, 500, err)
}
