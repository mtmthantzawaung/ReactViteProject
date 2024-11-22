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

export default function Root() {
  const { contacts, q } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const searchRef = useRef();
  const [isSearching, setIsSearching] = useState(false);

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

  // const searching =
  //   navigation.location &&
  //   new URLSearchParams(navigation.location.search).has("q");

  return (
    <>
      <div id="sidebar">
        <h1>React Router Contacts</h1>
        <div>
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
          {/* New Contact Form */}
          <Form method="post">
            <button type="submit">New</button>
          </Form>
        </div>
        <nav>
          {contacts.length ? (
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
      {/* all the other elements */}
      <div id="detail" className={isSearching ? "loading" : ""}>
        <Outlet />
      </div>
    </>
  );
}

export async function loader({ request }) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const contacts = await getContacts(q);
  return { contacts, q };
}

export async function action() {
  const contact = await createContact();
  return redirect(`/contacts/${contact.id}/edit`);
}
