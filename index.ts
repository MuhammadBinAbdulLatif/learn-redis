import express from "express"
import restaurantRouter from "./routes/restaurants.js"
import cursineRouter  from "./routes/cuisines.js"
import { errorHandler } from "./middlewares/errorHandler.js"
const PORT  = process.env.PORT || 3000

const app = express()

app.use(express.json())
app.use("/restaurants", restaurantRouter)
app.use("/cuisines", cursineRouter)

app.use(errorHandler);
app.listen(PORT, ()=> {
  console.log("Application running on PORT", PORT)
})
.on("error", (error)=> {
  throw new Error(error.message)
})
