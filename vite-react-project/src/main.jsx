import { Children, StrictMode } from "react";
import * as ReactDOM from "react-dom/client";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from "react-router-dom";
import "./index.css";
import "./App.css";
import Login from "./routes/login.jsx";
import Root, {
  loader as rootLoader,
  action as rootAction,
  loader,
} from "./routes/root.jsx";
import ErrorPage from "./error-page.jsx";
import Contact, {
  loader as contactLoader,
  action as contactAction,
} from "./routes/contact";
import EditContact, { action as editAction } from "./routes/edit.jsx";
import { action as destoryAction } from "./routes/destroy.jsx";
import Index from "./routes/index";
import { AuthProvider } from "./provider/authProvider.jsx";
import ProtectedRoute from "./routes/protectedRoute.jsx";

// const router = createBrowserRouter([
//   {
//     path: "/",
//     element: <Root />,
//     errorElement: <ErrorPage />,
//     loader: rootLoader,
//     action: rootAction,
//     children: [
//       {
//         errorElement: <ErrorPage />,
//         children: [
//           /* the begin of the routes */
//           {
//             index: true,
//             element: <Index />,
//           },
//           {
//             path: "contacts/:contactId",
//             element: <Contact />,
//             loader: contactLoader,
//             action: contactAction,
//           },
//           {
//             path: "contacts/:contactId/edit",
//             element: <EditContact />,
//             loader: contactLoader,
//             action: editAction,
//           },
//           {
//             path: "contacts/:contactId/destroy",
//             action: destoryAction,
//           },
//           /* the rest of the routes */
//         ],
//       },
//     ],
//   },
// ]);

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      {/* Public Route */}
      <Route path="login" element={<Login />} />

      {/* Protected Routes */}
      <Route
        path="/"
        element={<Root />}
        loader={rootLoader}
        action={rootAction}
        errorElement={<ErrorPage />}
      >
        <Route element={<ProtectedRoute />}>
          <Route errorElement={<ErrorPage />}>
            <Route index element={<Index />} />
            <Route
              path="contacts/:contactId"
              element={<Contact />}
              loader={contactLoader}
              action={contactAction}
            />
            <Route
              path="contacts/:contactId/edit"
              element={<EditContact />}
              loader={contactLoader}
              action={editAction}
            />
            <Route path="contacts/:contactId/destroy" action={destoryAction} />
          </Route>
        </Route>
      </Route>
    </>
  )
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>
);
