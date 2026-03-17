import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // 1. 初始化标准配置
  await prisma.setting.upsert({
    where: { id: 'standard' },
    update: {},
    create: {
      weekdayMinNum: 2,
      weekendMinNum: 4,
      maxConsecutive: 6
    }
  })

  // 2. 初始化一些示例员工
  const users = [
    { name: '张三', role: 'EMPLOYEE' },
    { name: '李四', role: 'EMPLOYEE' },
    { name: '王五', role: 'EMPLOYEE' },
    { name: '赵六', role: 'EMPLOYEE' },
    { name: '钱七', role: 'EMPLOYEE' },
    { name: '管理员', role: 'ADMIN' },
  ]

  for (const user of users) {
    await prisma.user.upsert({
      where: { name: user.name }, // 这里假设名字唯一，实际应用中应使用 ID
      update: { role: user.role },
      create: user
    })
  }

  // 3. 初始化 2026年3月 的部分节假日 (示例)
  const holidays = [
    { date: new Date('2026-03-08'), name: '妇女儿女节', type: 'HOLIDAY' }, // 示例
    { date: new Date('2026-03-14'), name: '周末', type: 'HOLIDAY' },
    { date: new Date('2026-03-15'), name: '周末', type: 'HOLIDAY' },
  ]

  for (const h of holidays) {
    await prisma.holiday.upsert({
      where: { date: h.date },
      update: {},
      create: h
    })
  }

  console.log('Seed data created successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
