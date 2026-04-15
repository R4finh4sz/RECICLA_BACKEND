import type { Core } from '@strapi/strapi';

export interface IBruteForceService {
  recordAttempt(identifier: string, success: boolean): Promise<{ blocked: boolean; delayMs: number }>;
  isBlocked(identifier: string): Promise<boolean>;
}

export class BruteForceService implements IBruteForceService {
  private strapi: Core.Strapi;
  private maxAttempts = 5;
  private blockDurationMinutes = 15;

  constructor(strapi: Core.Strapi) {
    this.strapi = strapi;
  }

  async recordAttempt(identifier: string, success: boolean): Promise<{ blocked: boolean; delayMs: number }> {
    if (success) {
      await this.resetAttempts(identifier);
      return { blocked: false, delayMs: 0 };
    }

    const attempts = await this.getAttempts(identifier);
    const newCount = (attempts?.count || 0) + 1;
    
    await this.updateAttempts(identifier, newCount);

    if (newCount >= this.maxAttempts) {
      return { blocked: true, delayMs: 0 };
    }

    // Atraso progressivo nas falhas (ex: 500ms * número de falhas)
    return { blocked: false, delayMs: newCount * 500 };
  }

  async isBlocked(identifier: string): Promise<boolean> {
    const record = await this.getAttempts(identifier);
    if (!record) return false;

    if (record.count >= this.maxAttempts) {
      const now = new Date();
      const lastAttempt = new Date(record.updatedAt);
      const diffMinutes = (now.getTime() - lastAttempt.getTime()) / (1000 * 60);

      if (diffMinutes < this.blockDurationMinutes) {
        return true;
      } else {
        // Resetar se o tempo de bloqueio passou
        await this.resetAttempts(identifier);
        return false;
      }
    }

    return false;
  }

  private async getAttempts(identifier: string) {
    return await this.strapi.db.query('api::brute-force-attempt.brute-force-attempt').findOne({
      where: { identifier },
    });
  }

  private async updateAttempts(identifier: string, count: number) {
    const record = await this.getAttempts(identifier);
    if (record) {
      await this.strapi.db.query('api::brute-force-attempt.brute-force-attempt').update({
        where: { identifier },
        data: { count },
      });
    } else {
      await this.strapi.db.query('api::brute-force-attempt.brute-force-attempt').create({
        data: { identifier, count },
      });
    }
  }

  private async resetAttempts(identifier: string) {
    await this.strapi.db.query('api::brute-force-attempt.brute-force-attempt').delete({
      where: { identifier },
    });
  }
}
