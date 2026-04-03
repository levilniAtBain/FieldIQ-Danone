import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 text-white text-2xl font-bold mb-4">
            FQ
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">FieldIQ</h1>
          <p className="text-sm text-gray-500 mt-1">
            L&apos;Oréal Field Force · Pharmacy Sales
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
