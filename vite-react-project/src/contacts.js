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

export async function getContacts(q = "") {
  console.log("q", q);
  console.log("q", typeof q);
  // Check if `q` is neither empty nor null
  if (q || q.trim() !== "") {
    console.log("data ==", data);
    const filteredData = data.filter((contact) => {
      return (
        contact.first.toLowerCase().includes(q.toLowerCase()) || // Case-insensitive search
        contact.last.toLowerCase().includes(q.toLowerCase())
      );
    });
    console.log("Filtered data:", filteredData);
    return filteredData;
  }
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
  let isUpdate = false;
  data = data.map((contact) => {
    if (contact.id === Number(id)) {
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
