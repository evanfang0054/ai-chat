process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_chat';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'change-me';
process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-key';
process.env.DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
process.env.DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

import { SCHEDULE_TICK_JOB } from '../../common/queue/queue.constants';

describe('ScheduleTickProcessor', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls processDueSchedules for schedule tick jobs', async () => {
    const processDueSchedules = jest.fn().mockResolvedValue(undefined);
    const { ScheduleTickProcessor } = await import('./schedule-tick.processor');
    const processor = new ScheduleTickProcessor({ processDueSchedules } as never);

    const before = Date.now();
    await processor.process({ name: SCHEDULE_TICK_JOB } as never);
    const after = Date.now();

    expect(processDueSchedules).toHaveBeenCalledTimes(1);
    expect(processDueSchedules).toHaveBeenCalledWith(expect.any(Date));
    const calledAt = processDueSchedules.mock.calls[0][0] as Date;
    expect(calledAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(calledAt.getTime()).toBeLessThanOrEqual(after);
  });

  it('ignores unexpected job names', async () => {
    const processDueSchedules = jest.fn().mockResolvedValue(undefined);
    const { ScheduleTickProcessor } = await import('./schedule-tick.processor');
    const processor = new ScheduleTickProcessor({ processDueSchedules } as never);

    await processor.process({ name: 'other-job' } as never);

    expect(processDueSchedules).not.toHaveBeenCalled();
  });
});
