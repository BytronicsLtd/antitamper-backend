const { default: mongoose } = require("mongoose");
const parseBoolean = require("../utils/parseBoolean.util");

// base url
const base_url = process.env.API_BASE_URL;
let registered_routes = []; // array of registered routes
let models = []
//setter for registered route
const setRoutes = (routes) => {
    registered_routes = routes
};
//getter for registered routes
const getRoutes = ({ show_system_routes, show_admin_routes }) => {
    let route_obj = {
        //users: [{}]
    }
    registered_routes.forEach(route => {
        const name = route.url.split('/')[3] || route.url.split('/')[1];
        const url = base_url + route.url;
        const uri = route.url;
        const method = route.method;
        route_obj[name] = route_obj[name]
        if (name && listRoute({ name, show_system_routes, show_admin_routes })) {
            if (route_obj[name] && route_obj[name] === route_obj[name]) {
                route_obj[name].push({ method, url, uri })
            } else {
                urls = []
                urls.push({ method, url, uri });

                route_obj[name] = urls
            }
        }
    });
    // console.log('route object: ', route_obj);
    return route_obj
}
//get models
const getModels = ({show_system_models})=>{
    models =  mongoose.modelNames()
    return models
}
module.exports = { setRoutes, getRoutes, getModels }

function listRoute({ name, show_system_routes, show_admin_routes }) {
    if (parseBoolean(show_system_routes) && name === "system") return true
    if (!parseBoolean(show_system_routes) && name === "system") return false
    //
    if (parseBoolean(show_admin_routes) && name === "admin") return true
    if (!parseBoolean(show_admin_routes) && name === "admin") return false
    return true
}