function getUser(users, id) {
    return users.find(user => user.id === id).name;
}

const users = [];

console.log(getUser(users, 1));