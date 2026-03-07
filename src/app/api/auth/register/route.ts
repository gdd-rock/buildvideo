import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { logAuthAction } from '@/lib/logging/semantic'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { prisma } from '@/lib/prisma'

export const POST = apiHandler(async (request: NextRequest) => {
  let name = 'unknown'
  const body = await request.json()
  name = body.name || 'unknown'
  const { password } = body

  // 验证输入
  if (!name || !password) {
    logAuthAction('REGISTER', name, { error: 'Missing credentials' })
    throw new ApiError('INVALID_PARAMS')
  }

  if (password.length < 8) {
    logAuthAction('REGISTER', name, { error: 'Password too short (min 8)' })
    throw new ApiError('INVALID_PARAMS')
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    logAuthAction('REGISTER', name, { error: 'Password must contain letters and numbers' })
    throw new ApiError('INVALID_PARAMS')
  }

  // 检查用户是否已存在
  const existingUser = await prisma.user.findUnique({
    where: { name }
  })

  if (existingUser) {
    logAuthAction('REGISTER', name, { error: 'Phone number already exists' })
    throw new ApiError('INVALID_PARAMS')
  }

  // 哈希密码
  const hashedPassword = await bcrypt.hash(password, 12)

  // 创建用户（事务）
  const user = await prisma.$transaction(async (tx) => {
    // 创建用户
    const newUser = await tx.user.create({
      data: {
        name,
        password: hashedPassword}
    })

    // 💰 创建用户余额记录（初始余额为0）
    await tx.userBalance.create({
      data: {
        userId: newUser.id,
        balance: 0,
        frozenAmount: 0,
        totalSpent: 0
      }
    })

    return newUser
  })

  logAuthAction('REGISTER', name, { userId: user.id, success: true })

  return NextResponse.json(
    {
      message: "注册成功",
      user: {
        id: user.id,
        name: user.name
      }
    },
    { status: 201 }
  )
})
