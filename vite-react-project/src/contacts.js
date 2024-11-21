let data = [
  {
    id: 1,
    first: "John",
    last: "Doe",
    avatar: "https://robohash.org/you.png?size=200x200",
    twitter: "your_handle",
    notes: "Some notes",
    favorite: true,
  },
  {
    id: 2,
    first: "Jane",
    last: "Smith",
    avatar: "https://robohash.org/you.png?size=200x200",
    twitter: "your_handle",
    notes: "Some notes",
    favorite: true,
  },
  {
    id: 3,
    first: "Your",
    last: "Name",
    avatar: "https://robohash.org/you.png?size=200x200",
    twitter: "your_handle",
    notes: "Some notes",
    favorite: true,
  },
];

export async function getContacts() {
  return data;
}

export async function getContact(id) {
  console.log("Type of id:", typeof id);
  const contact = data.find((contact) => contact.id === Number(id));
  return contact;
}

export async function createContact() {
  const id = Date.now();
  return {
    id: id,
    first: "",
    last: "",
    avatar: "",
    twitter: "",
    notes: "",
    favorite: false,
  };
}

export async function updateContact(id, updateContact) {
  const isUpdate = false;
  data = data.map((contact) => {
    console.log("here");
    if (contact.id === Number(id)) {
      console.log("here true");
      isUpdate = true;
      return { ...contact, ...updateContact };
    }
    return contact;
  });
  if (!isUpdate) {
    updateContact = { ...updateContact, id: Number(id) };
    data = [...data, updateContact];
  }
  return data;
}

export async function deleteContact(id) {
  console.log("before", data);
  data = data.filter((contact) => {
    return contact.id != Number(id);
  });
  console.log(data);
  return data;
}
