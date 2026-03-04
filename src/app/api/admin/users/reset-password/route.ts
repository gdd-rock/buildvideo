import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth, isErrorResponse } from '@/lib/api-auth'
import { ApiError, apiHandler } from '@/lib/api-errors'

export const POST = apiHandler(async (request: NextRequest) => {
  const authResult = await requireAdminAuth()
  if (isErrorResponse(authResult)) return authResult

  const body = await request.json()
  const { userId, newPassword } = body

  if (!userId || !newPassword) {
    throw new ApiError('INVALID_PARAMS')
  }

  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new ApiError('INVALID_PARAMS', { message: '密码长度不能少于6位' })
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new ApiError('NOT_FOUND')
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  })

  return NextResponse.json({ success: true })
})
