import * as React from "react";
import Input from "@mui/material/Input";
import { useForm } from "react-hook-form";
import { Password } from "@mui/icons-material";
import { useAuth } from "../provider/authProvider";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const { login } = useAuth();
  const navigate = useNavigate();
  const onSubmit = (data) => {
    console.log(data);
    login(data);
    navigate("/");
  };

  return (
    <>
      <div className="flex justify-center items-center h-screen w-full bg-gray-900">
        <div className=" bg-gradient-to-r rounded-lg py-10 px-12 from-teal-900 to-teal-800">
          <div className="sm:mx-auto sm:w-full sm:max-w-sm">
            <img
              alt="Your Company"
              src="https://tailwindui.com/plus/img/logos/mark.svg?color=indigo&shade=600"
              className="mx-auto h-10 w-auto"
            />
            <h2 className="hyphens-auto mt-5 text-center text-2xl/9 font-bold tracking-tight text-slate-300">
              Sign in with your account
            </h2>
          </div>

          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-6"
              style={{ width: "300px" }}
            >
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm/6 font-medium text-slate-300"
                >
                  Email address
                </label>
                <div className="mt-2">
                  <input
                    {...register("email", {
                      required: "Email is Required.",
                      maxLength: { value: 20, message: "Max Length is 20" },
                    })}
                    type="email"
                    autoComplete="email"
                    className="px-2 focus:outline-none mb-1 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm/6"
                  />
                  <span className="text-red-800">{errors.email?.message}</span>
                </div>
              </div>

              <div className="">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm/6 font-medium text-slate-300"
                  >
                    Password
                  </label>
                  <div className="text-sm">
                    <a
                      href="#"
                      className="font-semibold text-indigo-600 hover:text-indigo-500"
                    >
                      Forgot password?
                    </a>
                  </div>
                </div>
                <div className="">
                  <input
                    {...register("password", {
                      required: "Password is Required.",
                      validate: {
                        maxLength: (value) =>
                          value.length <= 20 ||
                          "Password must be 20 characters or less.",
                        minLength: (value) =>
                          value.length >= 8 ||
                          "Password must be at least 8 characters.",
                        hasNumber: (value) =>
                          /\d/.test(value) ||
                          "Password must include at least one digit.",
                        hasLowercase: (value) =>
                          /[a-z]/.test(value) ||
                          "Password must include at least one lowercase letter.",
                        hasUppercase: (value) =>
                          /[A-Z]/.test(value) ||
                          "Password must include at least one uppercase letter.",
                        hasSpecialChar: (value) =>
                          /\W/.test(value) ||
                          "Password must include at least one special character.",
                        noSpace: (value) =>
                          !/\s/.test(value) ||
                          "Password must not contain spaces.",
                      },
                    })}
                    type="password"
                    autoComplete="current-password"
                    className="px-2 focus:outline-none mb-1 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm/6"
                  />
                  <span className="text-wrap text-red-800 mt-1 text-sm space-y-1 overflow-hidden max-w-full break-words">
                    {errors.password?.message}
                  </span>
                </div>
              </div>

              <div className="">
                <button
                  type="submit"
                  className="mt-5 flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  Sign in
                </button>
              </div>
            </form>

            <p className="mt-8 text-center text-sm/6 text-gray-500">
              Not a member?{" "}
              <a
                href="#"
                className="font-semibold text-indigo-600 hover:text-indigo-500"
              >
                Start a 14 day free trial
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
