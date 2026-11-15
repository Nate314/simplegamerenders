# Serves the static files as-is, the same way GitHub Pages does. No build step.
FROM nginxinc/nginx-unprivileged:alpine
USER root
# Drop nginx's sample pages so only this repo's files are served. There is no root index.html,
# so list the folders at / instead of returning 403.
RUN rm /usr/share/nginx/html/* \
 && echo 'autoindex on;' > /etc/nginx/conf.d/pages.conf
COPY . /usr/share/nginx/html
USER 101
EXPOSE 8080
