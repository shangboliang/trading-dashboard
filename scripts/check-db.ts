import prisma from '../src/lib/prisma'; prisma.apiKey.findMany().then(keys => console.log(keys))
