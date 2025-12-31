FROM nginx:alpine

# 1. Xóa file config mặc định của Nginx đi (để tránh xung đột)
RUN rm /etc/nginx/conf.d/default.conf

# 2. Copy file config mới của bạn vào đúng chỗ
# (Trong image nginx:alpine, thư mục include mặc định là conf.d chứ không phải sites-enabled)
COPY default.conf /etc/nginx/conf.d/

# 3. Xóa code mặc định cũ
RUN rm -rf /usr/share/nginx/html/*

# 4. Copy code web của bạn vào
COPY . /usr/share/nginx/html

EXPOSE 80