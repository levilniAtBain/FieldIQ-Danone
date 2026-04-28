import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <img src="/field_iq_logo_danone.svg" className="h-20 w-auto rounded-xl mx-auto mb-4" alt="FieldIQ" />
          <h1 className="text-2xl font-semibold text-gray-900">FieldIQ</h1>
          <p className="text-sm text-gray-500 mt-1">
            Danone Field Force · Pharmacy Sales
          </p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <LoginForm />
        </div>

        <p className="text-center text-xs text-gray-400">
          FieldIQ Alpha · Confidential
        </p>
      </div>
    </div>
  );
}
