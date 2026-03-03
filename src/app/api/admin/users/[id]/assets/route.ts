import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth, isErrorResponse, notFound } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-errors'

export const GET = apiHandler(async (
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => {
  const authResult = await requireAdminAuth()
  if (isErrorResponse(authResult)) return authResult

  const { id } = await ctx.params

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true },
  })

  if (!user) return notFound('User')

  const [characters, locations, voices] = await Promise.all([
    prisma.globalCharacter.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        aliases: true,
        profileConfirmed: true,
        voiceType: true,
        createdAt: true,
        folder: { select: { name: true } },
        appearances: {
          orderBy: { appearanceIndex: 'asc' },
          take: 1,
          select: {
            imageUrl: true,
            description: true,
          },
        },
      },
    }),
    prisma.globalLocation.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        summary: true,
        createdAt: true,
        folder: { select: { name: true } },
        images: {
          where: { isSelected: true },
          take: 1,
          select: {
            imageUrl: true,
            description: true,
          },
        },
      },
    }),
    prisma.globalVoice.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        voiceType: true,
        gender: true,
        language: true,
        createdAt: true,
        folder: { select: { name: true } },
      },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      userName: user.name,
      characters,
      locations,
      voices,
    },
  })
})
