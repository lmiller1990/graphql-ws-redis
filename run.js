// @ts-check
import execa from 'execa'

// compile GraphQL server
execa.execaSync("npm", ["start"])
