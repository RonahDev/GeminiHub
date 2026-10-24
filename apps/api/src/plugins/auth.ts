import { FastifyRequest, FastifyReply } from 'fastify';
import { Role } from '@geminihub/shared';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string;
      email: string;
      role: Role;
    };
    user: {
      userId: string;
      email: string;
      role: Role;
    };
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch (err) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Vui lòng đăng nhập để thực hiện chức năng này',
      },
    });
  }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  if (reply.sent) return;

  if (req.user?.role !== Role.ADMIN) {
    return reply.status(403).send({
      error: {
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền thực hiện thao tác quản trị này',
      },
    });
  }
}

export async function requireStaffOrAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  if (reply.sent) return;

  if (req.user?.role !== Role.ADMIN && req.user?.role !== Role.STAFF) {
    return reply.status(403).send({
      error: {
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền nhân viên hoặc quản trị',
      },
    });
  }
}
