# Sử dụng Nginx nhẹ
FROM nginx:alpine

# Xóa trang Welcome mặc định đi
RUN rm -rf /usr/share/nginx/html/*

# Copy code của bạn (dấu chấm .) vào thư mục hiển thị web của Nginx
COPY . /usr/share/nginx/html

# Mở cổng 80 (Mặc định của Nginx)
EXPOSE 80