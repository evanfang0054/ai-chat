process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_chat';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'change-me';
process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-key';
process.env.DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
process.env.DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

describe('ManageScheduleToolFactory', () => {
  it('preserves existing CRON expression when update switches to CRON without cronExpr', async () => {
    const updateSchedule = jest.fn().mockResolvedValue({
      id: 'schedule-1',
      title: 'Updated title'
    });
    const scheduleService = {
      createSchedule: jest.fn(),
      listSchedules: jest.fn(),
      updateSchedule,
      enableSchedule: jest.fn(),
      disableSchedule: jest.fn()
    };
    const moduleRef = {
      get: jest.fn().mockReturnValue(scheduleService)
    };

    const { ManageScheduleToolFactory } = await import('./manage-schedule.tool');
    const tool = new ManageScheduleToolFactory(moduleRef as never).create();

    await tool.execute(
      {
        action: 'update',
        scheduleId: 'schedule-1',
        type: 'CRON',
        title: 'Updated title'
      },
      { userId: 'user-1', sessionId: 'session-1' }
    );

    expect(updateSchedule).toHaveBeenCalledWith('user-1', 'schedule-1', {
      type: 'CRON',
      title: 'Updated title',
      taskPrompt: undefined,
      timezone: undefined,
      enabled: undefined
    });
  });

  it('preserves existing ONE_TIME runAt when update switches to ONE_TIME without runAt', async () => {
    const updateSchedule = jest.fn().mockResolvedValue({
      id: 'schedule-2',
      title: 'Updated title'
    });
    const scheduleService = {
      createSchedule: jest.fn(),
      listSchedules: jest.fn(),
      updateSchedule,
      enableSchedule: jest.fn(),
      disableSchedule: jest.fn()
    };
    const moduleRef = {
      get: jest.fn().mockReturnValue(scheduleService)
    };

    const { ManageScheduleToolFactory } = await import('./manage-schedule.tool');
    const tool = new ManageScheduleToolFactory(moduleRef as never).create();

    await tool.execute(
      {
        action: 'update',
        scheduleId: 'schedule-2',
        type: 'ONE_TIME',
        title: 'Updated title'
      },
      { userId: 'user-1', sessionId: 'session-1' }
    );

    expect(updateSchedule).toHaveBeenCalledWith('user-1', 'schedule-2', {
      type: 'ONE_TIME',
      title: 'Updated title',
      taskPrompt: undefined,
      timezone: undefined,
      enabled: undefined
    });
  });
});
