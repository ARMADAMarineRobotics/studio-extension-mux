ARG ROS_DISTRO=noetic

FROM ros:${ROS_DISTRO}

RUN apt update \
 && apt install -y \
        ros-${ROS_DISTRO}-rosbridge-server \
        ros-${ROS_DISTRO}-topic-tools \
 && rm -rf /var/lib/apt/lists/*

ADD launch.xml /

EXPOSE 9090
CMD [ "roslaunch", "launch.xml" ]
