# Example

This directory contains an example ROS application utilizing a [`mux`][mux] node that runs in a Docker container. It is built and executed with:

    docker build --tag ros-mux-example .
    docker run --rm --publish 9090:9090 --name ros-mux-example ros-mux-example

To monitor the republished data:

    docker exec ros-mux-example /ros_entrypoint.sh rostopic echo /out

To modify the `mux` node's configuration:

    docker exec ros-mux-example /ros_entrypoint.sh \
        rosrun topic_tools mux_list mux
    docker exec ros-mux-example /ros_entrypoint.sh \
        rosrun topic_tools mux_add mux /c
    docker exec ros-mux-example /ros_entrypoint.sh \
        rosrun topic_tools mux_select mux /c

The container also exposes a [Rosbridge server][rosbridge_suite] to which Foxglove Studio can connect.

  [mux]: https://wiki.ros.org/topic_tools/mux
  [rosbridge_suite]: https://wiki.ros.org/rosbridge_suite
