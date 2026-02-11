// remember that in most of the cases, redis is storing key-value pairs just like the noSQL databases (e.g Mongodb)
// so for every value that you want ot use, you have to give key and then its value
// key:value
// there is also a concept of prefix. Think of this like your way of separating between services in microservice arhitecture
// prefix:key:{id or any other identifier like slug}

export function getKeyName(...args: string[]) {
  return `bites:${args.join(":")}`;
  // these args are meant to be two
  // e.g getKeyName("user", "id_of_the_user")
  // this function will convert this to:
  // bites:user:id_of_the_user / any basic identifier that should be unique, otherwise redis with automatically overwrite it
  // and hence is a util function. not a technical redis function. We have done this for faster development
}
// making sure "restaurants" spelling is always constant
export const restaurantKeyById=(id: string)=> getKeyName("restaurants", id)


