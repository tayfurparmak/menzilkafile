export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  return {
    success: true,
    user: {
      id: user.userId,
      email: user.email,
      displayName: user.displayName,
      isActive: user.isActive,
    },
  }
})
