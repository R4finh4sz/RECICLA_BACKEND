import type { Core } from '@strapi/strapi';

export interface ITokenRevocationService {
  revoke(token: string, expiresAt: Date): Promise<void>;
  isRevoked(token: string): Promise<boolean>;
  cleanupExpired(): Promise<void>;
}

export class TokenRevocationService implements ITokenRevocationService {
  private strapi: Core.Strapi;

  constructor(strapi: Core.Strapi) {
    this.strapi = strapi;
  }

  async revoke(token: string, expiresAt: Date): Promise<void> {
    await this.strapi.db.query('api::revoked-token.revoked-token').create({
      data: {
        token,
        expiresAt,
      },
    });
  }

  async isRevoked(token: string): Promise<boolean> {
    const revoked = await this.strapi.db.query('api::revoked-token.revoked-token').findOne({
      where: { token },
    });
    return !!revoked;
  }

  async cleanupExpired(): Promise<void> {
    const now = new Date();
    await this.strapi.db.query('api::revoked-token.revoked-token').deleteMany({
      where: {
        expiresAt: {
          $lt: now,
        },
      },
    });
  }
}
