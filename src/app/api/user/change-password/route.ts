import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireUserAuth, isErrorResponse } from '@/lib/api-auth'
import { ApiError, apiHandler } from '@/lib/api-errors'

export const POST = apiHandler(async (request: NextRequest) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const body = await request.json()
  const { currentPassword, newPassword } = body

  if (!currentPassword || !newPassword) {
    throw new ApiError('INVALID_PARAMS')
  }

  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new ApiError('INVALID_PARAMS', { message: '密码长度不能少于6位' })
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user || !user.password) {
    throw new ApiError('NOT_FOUND')
  }

  const isValid = await bcrypt.compare(currentPassword, user.password)
  if (!isValid) {
    throw new ApiError('INVALID_PARAMS', { message: '当前密码不正确' })
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: hashedPassword },
  })

  return NextResponse.json({ success: true })
})
