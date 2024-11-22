import {
  Outlet,
  NavLink,
  useLoaderData,
  Form,
  redirect,
  useNavigation,
  useSubmit,
} from "react-router-dom";
import "../index.css";
import { getContacts, createContact } from "../contacts";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../provider/authProvider";
import Modal from "../components/modal";

export default function Root() {
  const { contacts, q } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const searchRef = useRef();
  const { logout } = useAuth();
  const [isSearching, setIsSearching] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpen = () => setIsModalOpen(true);
  const handleClose = () => setIsModalOpen(false);
  const handlePrimaryAction = () => {
    setIsModalOpen(false);
    logout();
  };

  // Set the input value from the loader data
  useEffect(() => {
    searchRef.current.value = q;
  }, [q]);

  useEffect(() => {
    if (navigation.state === "loading") {
      setIsSearching(true);
    } else {
      const timeout = setTimeout(() => setIsSearching(false), 300); // Delay resetting spinner visibility
      return () => clearTimeout(timeout);
    }
  }, [navigation.state]);

  console.log("rot2  is");
  return (
    <>
      <div id="sidebar">
        <h1>React Router Contacts</h1>
        <div className="flex flex-wrap">
          <Form id="search-form" role="search">
            <input
              ref={searchRef}
              id="q"
              className={isSearching ? "loading" : ""}
              aria-label="Search contacts"
              placeholder="Search"
              type="search"
              name="q"
              defaultValue={q}
              onChange={(e) => {
                const isFirstSearch = q == null;
                submit(e.currentTarget.form, {
                  replace: !isFirstSearch,
                });
              }}
            />
            <div id="search-spinner" aria-hidden hidden={!isSearching} />
            <div className="sr-only" aria-live="polite"></div>
          </Form>
          <div className="flex justify-between items-center w-full gap-1">
            {/* New Contact Form */}
            <Form method="post" className="flex-grow">
              <button
                className="w-full px-4 py-2  hover:bg-blue-600 transition"
                type="submit"
              >
                New
              </button>
            </Form>

            {/* Logout Button */}
            <button
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
              onClick={handleOpen}
            >
              Logout
            </button>
          </div>
        </div>

        <nav>
          {contacts && contacts.length > 0 ? (
            <ul>
              {contacts.map((contact) => (
                <li key={contact.id}>
                  <NavLink
                    to={`contacts/${contact.id}`}
                    className={({ isActive, isPending }) =>
                      isActive ? "active" : isPending ? "pending" : ""
                    }
                  >
                    {contact.first || contact.last ? (
                      <>
                        {contact.first} {contact.last}
                      </>
                    ) : (
                      <i>No Name</i>
                    )}{" "}
                    {contact.favorite && <span>★</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              <i>No contacts</i>
            </p>
          )}
        </nav>
      </div>
      {/* {Logout ConFirm Modal Box} */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleClose}
        title="Logout"
        description="Are You Sure Want To Log Out?"
        primaryActionText="Logout"
        secondaryActionText="Cancel"
        onPrimaryAction={handlePrimaryAction}
      />
      {/* {Logout ConFirm Modal Box} */}
      {/* all the other elements */}
      <div id="detail" className={isSearching ? "loading" : ""}>
        <Outlet />
      </div>
    </>
  );
}

export async function loader({ request }) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const contacts = await getContacts(q);
    return { contacts, q };
  } catch (error) {
    console.error(error);
    return { contacts: [], q: "" }; // Or use a redirect to an error page
  }
}

export async function action() {
  const contact = await createContact();
  return redirect(`/contacts/${contact.id}/edit`);
}
