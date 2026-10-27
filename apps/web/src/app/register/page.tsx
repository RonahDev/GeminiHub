'use client';

import React, { Suspense } from 'react';
import { RegisterForm } from '@/features/auth/RegisterForm';
import { Loader2 } from 'lucide-react';

export default function RegisterPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        }
      >
        <RegisterForm />
      </Suspense>
    </div>
  );
}
